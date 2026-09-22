import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service.js';
import { GetUploadUrlDto, UploadContext } from './dto/get-upload-url.dto.js';
import { AttachOrderFileDto } from './dto/attach-file.dto.js';
import { UserRole, FileCategory, Prisma } from '@prisma/client';
import crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly isConfigured: boolean = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const accountId = this.configService.get<string>('storage.accountId') || '';
    const accessKeyId = this.configService.get<string>('storage.accessKeyId') || '';
    const secretAccessKey = this.configService.get<string>('storage.secretAccessKey') || '';
    this.bucketName = this.configService.get<string>('storage.bucketName') || 'rizex-bucket';
    this.publicUrl = (this.configService.get<string>('storage.publicUrl') || '').replace(/\/$/, '');

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      this.logger.log(`Cloudflare R2 Storage initialized for bucket: ${this.bucketName}`);
    } else {
      this.logger.warn(
        'Cloudflare R2 credentials are not fully configured in .env. Running in Mock/Development Storage Mode.',
      );
    }
  }

  /**
   * 1. Generate secure Presigned PUT Upload URL for direct browser-to-R2 upload
   */
  async getUploadPresignedUrl(
    user: { id: string; role: UserRole },
    dto: GetUploadUrlDto,
  ) {
    // Verify order access if orderId is provided
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { assignments: { where: { unassignedAt: null } } },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID '${dto.orderId}' not found.`);
      }

      if (user.role === UserRole.CLIENT && order.clientId !== user.id) {
        throw new ForbiddenException('Access denied. You can only upload files to your own orders.');
      }

      if (user.role === UserRole.TEAM_MEMBER) {
        const isAssigned = order.assignments.some((a) => a.memberId === user.id);
        if (!isAssigned) {
          throw new ForbiddenException('Access denied. You are not assigned to this project.');
        }
      }
    }

    // Sanitize file name
    const sanitizedName = dto.fileName
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '_')
      .replace(/_+/g, '_');

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const timestamp = Date.now();

    // Construct clean structured key path
    let key: string;
    if (dto.orderId) {
      const category = (dto.category || FileCategory.OTHER).toLowerCase();
      key = `orders/${dto.orderId}/${category}/${timestamp}-${randomSuffix}-${sanitizedName}`;
    } else if (dto.context === UploadContext.SERVICE_ASSET) {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Only administrators can upload service catalog assets.');
      }
      key = `services/${dto.serviceId || 'general'}/${timestamp}-${randomSuffix}-${sanitizedName}`;
    } else if (dto.context === UploadContext.AVATAR) {
      key = `avatars/${user.id}/${timestamp}-${randomSuffix}-${sanitizedName}`;
    } else {
      key = `uploads/${user.id}/${timestamp}-${randomSuffix}-${sanitizedName}`;
    }

    // Fallback if R2 credentials not active
    if (!this.isConfigured || !this.s3Client) {
      const mockUploadUrl = `http://localhost:5000/api/v1/storage/mock-upload?key=${encodeURIComponent(key)}`;
      const fileUrl = this.publicUrl ? `${this.publicUrl}/${key}` : mockUploadUrl;

      return {
        uploadUrl: mockUploadUrl,
        key,
        fileUrl,
        expiresInSeconds: 900,
        isMock: true,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: dto.contentType,
    });

    // 15 minutes validity
    const expiresInSeconds = 900;
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const fileUrl = this.publicUrl ? `${this.publicUrl}/${key}` : '';

    return {
      uploadUrl,
      key,
      fileUrl,
      expiresInSeconds,
      isMock: false,
    };
  }

  /**
   * 2. Generate secure Presigned GET Download URL for private/sensitive assets
   */
  async getDownloadPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!key) {
      throw new BadRequestException('Storage key is required to generate download URL.');
    }

    // If public URL is configured and key is public asset, return direct public URL
    if (this.publicUrl && (key.startsWith('services/') || key.startsWith('avatars/'))) {
      return `${this.publicUrl}/${key}`;
    }

    if (!this.isConfigured || !this.s3Client) {
      return this.publicUrl ? `${this.publicUrl}/${key}` : `http://localhost:5000/api/v1/storage/mock-download?key=${encodeURIComponent(key)}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * 3. Attach uploaded file metadata to an Order in Database
   */
  async attachFileToOrder(
    orderId: string,
    userId: string,
    dto: AttachOrderFileDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { assignments: { where: { unassignedAt: null } } },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found.`);
    }

    if (currentUser.role === UserRole.CLIENT && order.clientId !== currentUser.id) {
      throw new ForbiddenException('Access denied. You can only attach files to your own order.');
    }

    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some((a) => a.memberId === currentUser.id);
      if (!isAssigned) {
        throw new ForbiddenException('Access denied. You are not assigned to this project.');
      }
    }

    // Determine final file access URL (Public URL if available or generated fallback)
    const effectiveUrl = dto.url || (this.publicUrl ? `${this.publicUrl}/${dto.key}` : '');

    const projectFile = await this.prisma.projectFile.create({
      data: {
        orderId,
        uploaderId: userId,
        name: dto.name,
        key: dto.key,
        url: effectiveUrl,
        mimeType: dto.mimeType || null,
        size: dto.size || null,
        category: dto.category || FileCategory.OTHER,
      },
      include: {
        uploader: {
          select: { id: true, name: true, role: true, image: true },
        },
      },
    });

    return {
      message: 'File successfully attached to order.',
      file: projectFile,
    };
  }

  /**
   * 4. Get all files for an order with dynamic signed download URLs
   */
  async getOrderFilesWithUrls(
    orderId: string,
    currentUser: { id: string; role: UserRole },
    category?: FileCategory,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { assignments: { where: { unassignedAt: null } } },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' was not found.`);
    }

    if (currentUser.role === UserRole.CLIENT && order.clientId !== currentUser.id) {
      throw new ForbiddenException('Access denied.');
    }

    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some((a) => a.memberId === currentUser.id);
      if (!isAssigned) {
        throw new ForbiddenException('Access denied.');
      }
    }

    const where: Prisma.ProjectFileWhereInput = { orderId };
    if (category) {
      where.category = category;
    }

    const files = await this.prisma.projectFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: {
          select: { id: true, name: true, role: true, image: true },
        },
      },
    });

    // Attach fresh signed download URLs
    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        let downloadUrl = file.url;
        if (file.key) {
          try {
            downloadUrl = await this.getDownloadPresignedUrl(file.key, 3600);
          } catch (e) {
            this.logger.error(`Failed to generate signed URL for key ${file.key}`, e);
          }
        }
        return {
          ...file,
          downloadUrl,
        };
      }),
    );

    return filesWithUrls;
  }

  /**
   * 5. Delete file from R2 and remove metadata from database
   */
  async deleteOrderFile(
    fileId: string,
    currentUser: { id: string; role: UserRole },
  ) {
    const file = await this.prisma.projectFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException(`File with ID '${fileId}' was not found.`);
    }

    // Only file uploader or admin can delete
    if (currentUser.role !== UserRole.ADMIN && file.uploaderId !== currentUser.id) {
      throw new ForbiddenException('Access denied. You can only delete files you uploaded.');
    }

    // Delete object from Cloudflare R2 if key exists
    if (file.key && this.isConfigured && this.s3Client) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: file.key,
        });
        await this.s3Client.send(deleteCommand);
      } catch (error) {
        this.logger.warn(`Could not delete object from R2: ${file.key}`, error);
      }
    }

    await this.prisma.projectFile.delete({
      where: { id: fileId },
    });

    return {
      message: 'File successfully deleted.',
    };
  }
}

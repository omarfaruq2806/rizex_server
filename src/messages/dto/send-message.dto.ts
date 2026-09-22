import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for sending a message in an Order chat room
 */
export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  content: string;
}

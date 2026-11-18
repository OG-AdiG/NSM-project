import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady = false;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    const forcePathStyle = this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    this.bucket = this.config.get<string>('S3_BUCKET', 'nsm-files');
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION', 'us-east-1'),
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.config.get<string>('S3_SECRET_KEY', 'minioadmin'),
      },
      // AWS SDK v3 domyślnie dodaje checksumy, których starsze MinIO nie lubi
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
      this.logger.log(`Bucket S3 gotowy: ${this.bucket}`);
    } catch (err) {
      this.logger.warn(
        `Nie udało się przygotować bucketa MinIO (${this.bucket}). Upload zdjęć wymaga działającego MinIO.`,
      );
      this.logger.warn(err instanceof Error ? err.message : String(err));
    }
  }

  async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.bucketReady = true;
  }

  buildObjectKey(submissionId: string, originalName: string) {
    const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    return `submissions/${submissionId}/${randomUUID()}-${safe}`;
  }

  async uploadObject(key: string, body: Buffer, contentType: string) {
    if (!this.bucketReady) {
      await this.ensureBucket();
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error(
        `PutObject nieudany (${this.bucket}/${key}): ${err instanceof Error ? err.message : String(err)}`,
      );
      // bucket mógł powstać później — jedna ponowna próba po ensure
      this.bucketReady = false;
      await this.ensureBucket();
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    }
  }

  async deleteObject(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedGetUrl(key: string, expiresInSeconds = 60 * 15) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}

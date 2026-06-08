import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient | null = null;
  private readonly supabaseUrl: string | null;

  constructor(private configService: ConfigService) {
    const url = this.getConfigValue([
      'SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
    ]);
    const key = this.getConfigValue([
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_SERVICE_ROLE',
    ]);

    this.supabaseUrl = url;

    if (!url || !key) {
      this.logger.error(
        `Supabase storage configuration missing. urlConfigured=${Boolean(
          url,
        )} serviceRoleConfigured=${Boolean(key)}`,
      );
      return;
    }

    this.supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  private getConfigValue(keys: string[]): string | null {
    for (const key of keys) {
      const value = this.configService.get<string>(key)?.trim();
      if (value) {
        return value;
      }
    }

    return null;
  }

  private getStorageErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }

      return message ? JSON.stringify(message) : 'Unknown error';
    }

    return 'Unknown error';
  }

  getPublicUrl(path: string, bucket: string = 'tenaxis-docs') {
    if (!this.supabase) {
      // Si no hay cliente inicializado, intentamos construir la URL manualmente si tenemos la base URL
      if (this.supabaseUrl) {
        return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
      }
      return null;
    }

    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async getSignedUrls(
    paths: string[],
    bucket: string = 'tenaxis-docs',
    expiresIn: number = 3600,
  ) {
    if (!this.supabase || !paths.length) {
      return paths.map((p) => this.getPublicUrl(p, bucket));
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrls(paths, expiresIn);

      if (error || !data) {
        const errorMessage = this.getStorageErrorMessage(error);
        this.logger.error(`Error creating bulk signed URLs: ${errorMessage}`);
        return paths.map((p) => this.getPublicUrl(p, bucket));
      }

      // Map back to maintain original order and handle potentially missing results
      return paths.map((p) => {
        const item = data.find((d) => d.path === p);
        return item?.signedUrl || this.getPublicUrl(p, bucket);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Unexpected error creating bulk signed URLs: ${errorMessage}`,
      );
      return paths.map((p) => this.getPublicUrl(p, bucket));
    }
  }

  async getSignedUrl(
    path: string,
    bucket: string = 'tenaxis-docs',
    expiresIn: number = 3600,
  ) {
    if (!this.supabase) {
      this.logger.error(
        'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the API runtime environment.',
      );
      return this.getPublicUrl(path, bucket);
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        const errorMessage = this.getStorageErrorMessage(error);
        this.logger.error(
          `Error creating signed URL for ${path}: ${errorMessage}`,
        );
        // Si falla la firma, intentamos devolver la URL pública
        return this.getPublicUrl(path, bucket);
      }

      return data.signedUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Unexpected error creating signed URL: ${errorMessage}`,
      );
      return this.getPublicUrl(path, bucket);
    }
  }

  async uploadFile(
    path: string,
    buffer: Buffer,
    contentType: string,
    bucket: string = 'tenaxis-docs',
  ) {
    if (!this.supabase) {
      this.logger.error(
        'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the API runtime environment.',
      );
      return null;
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        const errorMessage = this.getStorageErrorMessage(error);
        this.logger.error(`Error uploading file ${path}: ${errorMessage}`);
        return null;
      }

      return data.path;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Unexpected error uploading file: ${errorMessage}`);
      return null;
    }
  }

  async createSignedUploadUrl(
    path: string,
    bucket: string = 'tenaxis-docs',
    upsert = false,
  ): Promise<{ signedUrl: string; token: string; path: string } | null> {
    if (!this.supabase) {
      this.logger.error(
        'Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the API runtime environment.',
      );
      return null;
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path, { upsert });

      if (error || !data?.signedUrl || !data?.token) {
        const errorMessage = this.getStorageErrorMessage(error);
        this.logger.error(
          `Error creating signed upload URL for ${path}: ${errorMessage}`,
        );
        return null;
      }

      return {
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path || path,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Unexpected error creating signed upload URL: ${errorMessage}`,
      );
      return null;
    }
  }
}

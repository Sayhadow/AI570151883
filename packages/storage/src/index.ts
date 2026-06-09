import { createReadStream, readFileSync } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type AssetStorageDriver = "local" | "s3";

export interface PutObjectInput {
  bytes: Buffer;
  contentType: string;
  objectKey: string;
}

export interface StoredObjectContent {
  stream: Readable;
}

export interface StoredObject {
  bucket: string;
  objectKey: string;
}

interface LocalStorageConfig {
  driver: "local";
  assetDir: string;
}

interface S3StorageConfig {
  driver: "s3";
  bucket: string;
  client: S3Client;
}

type AssetStorageConfig = LocalStorageConfig | S3StorageConfig;

export class AssetStorage {
  constructor(private readonly config: AssetStorageConfig) {}

  get driver() {
    return this.config.driver;
  }

  get bucketName() {
    return this.config.driver === "local" ? "local" : this.config.bucket;
  }

  canReadBucket(bucket: string) {
    return bucket === this.bucketName || (this.config.driver === "local" && bucket === "local");
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const objectKey = normalizeObjectKey(input.objectKey);

    if (this.config.driver === "local") {
      const outputPath = resolveLocalObjectPath(this.config.assetDir, objectKey);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, input.bytes);
      return { bucket: "local", objectKey };
    }

    await this.config.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: input.bytes,
        ContentType: input.contentType
      })
    );

    return { bucket: this.config.bucket, objectKey };
  }

  async getObjectContent(bucket: string, objectKey: string): Promise<StoredObjectContent> {
    if (!this.canReadBucket(bucket)) {
      throw new Error(`Storage bucket "${bucket}" is not configured`);
    }

    const normalizedObjectKey = normalizeObjectKey(objectKey);

    if (this.config.driver === "local") {
      return { stream: createReadStream(await this.resolveExistingLocalPath(normalizedObjectKey)) };
    }

    const response = await this.config.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: normalizedObjectKey
      })
    );

    if (!response.Body) {
      throw new Error(`Storage object "${normalizedObjectKey}" is empty`);
    }

    return { stream: await toNodeReadable(response.Body) };
  }

  private async resolveExistingLocalPath(objectKey: string) {
    const primaryPath = resolveLocalObjectPath(this.config.driver === "local" ? this.config.assetDir : "", objectKey);

    try {
      await access(primaryPath);
      return primaryPath;
    } catch {
      const legacyPath = resolveLocalObjectPath(
        this.config.driver === "local" ? this.config.assetDir : "",
        path.basename(objectKey)
      );
      await access(legacyPath);
      return legacyPath;
    }
  }
}

export function createAssetStorageFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const driver = normalizeDriver(env.ASSET_STORAGE_DRIVER);

  if (driver === "s3") {
    const bucket = requireEnv(env, "S3_BUCKET");
    const accessKeyId = requireEnv(env, "S3_ACCESS_KEY");
    const secretAccessKey = requireEnv(env, "S3_SECRET_KEY");
    const endpoint = env.S3_ENDPOINT?.trim() || undefined;
    const region = env.S3_REGION?.trim() || "auto";
    const forcePathStyle = normalizeBoolean(env.S3_FORCE_PATH_STYLE, true);

    return new AssetStorage({
      driver,
      bucket,
      client: new S3Client({
        endpoint,
        forcePathStyle,
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      })
    });
  }

  return new AssetStorage({
    driver,
    assetDir: resolveGeneratedAssetDir(env)
  });
}

function normalizeDriver(value: string | undefined): AssetStorageDriver {
  const normalized = value?.trim().toLowerCase();
  return normalized === "s3" ? "s3" : "local";
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
}

function requireEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required when ASSET_STORAGE_DRIVER=s3`);
  }

  return value;
}

function normalizeObjectKey(objectKey: string) {
  const normalized = objectKey.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized || normalized.split("/").some((segment) => segment === "..")) {
    throw new Error("Invalid storage object key");
  }

  return normalized;
}

function resolveLocalObjectPath(assetDir: string, objectKey: string) {
  const baseDir = path.resolve(assetDir);
  const objectPath = path.resolve(baseDir, normalizeObjectKey(objectKey));

  if (objectPath !== baseDir && !objectPath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Storage object key escapes the asset directory");
  }

  return objectPath;
}

function resolveGeneratedAssetDir(env: NodeJS.ProcessEnv) {
  const configured = env.GENERATED_ASSET_DIR;

  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(findWorkspaceRoot(), configured);
  }

  return path.join(findWorkspaceRoot(), ".generated-assets");
}

function findWorkspaceRoot() {
  let current = process.cwd();

  while (true) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(current, "package.json"), "utf8")) as {
        name?: string;
      };

      if (pkg.name === "ai-image-platform") {
        return current;
      }
    } catch {
      // Keep walking up until the workspace root is found.
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

async function toNodeReadable(body: unknown) {
  if (body instanceof Readable) {
    return body;
  }

  if (body && typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function") {
    return Readable.fromWeb((body as { transformToWebStream: () => NodeReadableStream }).transformToWebStream());
  }

  if (body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Readable.from([Buffer.from(bytes)]);
  }

  throw new Error("Storage response body is not readable");
}

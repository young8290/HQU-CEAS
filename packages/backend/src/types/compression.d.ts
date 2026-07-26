// compression 无官方内置类型且本项目依赖白名单不含 @types/compression，
// 这里提供本地最小声明（仅覆盖项目用到的默认用法）。
declare module 'compression' {
  import type { Request, RequestHandler, Response } from 'express';

  interface CompressionOptions {
    /** 触发压缩的最小响应体积（默认 1kb） */
    threshold?: number | string;
    /** zlib 压缩级别 */
    level?: number;
    filter?: (req: Request, res: Response) => boolean;
    [option: string]: unknown;
  }

  function compression(options?: CompressionOptions): RequestHandler;

  namespace compression {
    function filter(req: Request, res: Response): boolean;
  }

  export default compression;
}

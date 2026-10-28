import multer from 'multer';
import { Request } from 'express';
import { ApiError } from '../utils/apiError';

// Store in memory so we can forward to AI Backend easily
const storage = multer.memoryStorage();

export const uploadModelFile = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['.pth', '.pt', '.onnx', '.pkl'];
    const lowerName = file.originalname.toLowerCase();
    const isAllowed = allowed.some((ext) => lowerName.endsWith(ext));
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Chỉ chấp nhận các tệp mô hình máy học: .pth, .pt, .onnx, .pkl'));
    }
  },
});

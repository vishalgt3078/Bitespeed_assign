import { Router } from 'express';
import { handleIdentifyRequest } from '@/controllers/contactController';

const router = Router();

router.post('/identify', handleIdentifyRequest);

export default router;
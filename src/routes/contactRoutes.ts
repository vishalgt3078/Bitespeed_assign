import express from 'express';
import { handleIdentifyRequest } from '@/controllers/contactController';

const router = express.Router();

router.post('/identify', handleIdentifyRequest);

export default router;

import { Request, Response, NextFunction } from 'express';
import { identifyContact } from '@/services/contactService';

export const handleIdentifyRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      res.status(400).json({
        error: 'Either email or phoneNumber must be provided.'
      });
      return;
    }

    const phoneString =
      phoneNumber !== undefined && phoneNumber !== null
        ? String(phoneNumber)
        : null;

    const result = await identifyContact({
      email: email || null,
      phoneNumber: phoneString
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from 'express';
import { identifyContact } from '@/services/contactService';

export const handleIdentifyRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phoneNumber } = req.body;

    // Basic validation: As per problem, "will always have either an email or phoneNumber"
    // However, if they can be empty strings vs null, or if one can be missing entirely.
    // The service layer handles nulls, but ensuring at least one is present is good.
    if (email === undefined && phoneNumber === undefined) {
      return res.status(400).json({ 
        error: 'Either email or phoneNumber must be provided.' 
      });
    }
    // Convert phoneNumber to string if it's a number, as per schema String?
    const phoneString = phoneNumber !== undefined && phoneNumber !== null ? String(phoneNumber) : null;


    const result = await identifyContact({ 
      email: email || null, // Ensure null if undefined or empty string
      phoneNumber: phoneString 
    });
    res.status(200).json(result);
  } catch (error) {
    next(error); // Pass error to the global error handler
  }
};
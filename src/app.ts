import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import contactRoutes from '@/routes/contactRoutes'; // Using path alias

dotenv.config();

const app: Express = express();

// Middleware
app.use(express.json()); // Crucial for parsing JSON request bodies

// Routes
app.use('/api', contactRoutes); // Prefixing routes with /api

// Simple root route
app.get('/', (req: Request, res: Response) => {
  res.send('Bitespeed Identity Service is running!');
});

// Global Error Handler (Basic)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something went wrong!' });
});

export default app;
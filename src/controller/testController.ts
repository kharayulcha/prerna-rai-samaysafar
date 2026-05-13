import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../model/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'samaysafar_secret_key';
const SALT_ROUNDS = 10;

export const registerUser = async (req: Request, res: Response) => {
    try {
        const { name, email, password, phone, role } = req.body as {
            name?: string;
            email?: string;
            password?: string;
            phone?: string;
            role?: string;
        };

        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: 'Missing required fields: name, email, password, phone' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await prisma.users.findUnique({ where: { Email: normalizedEmail } });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.users.create({
                data: {
                    Name: name,
                    Email: normalizedEmail,
                    Phone: phone,
                    Role: role || 'user',
                },
            });

            await tx.credentials.create({
                data: {
                    UserId: createdUser.UserId,
                    PasswordHash: passwordHash,
                    MustChangePassword: false,
                },
            });

            return createdUser;
        });

        return res.status(201).json({
            message: 'User registered successfully',
            user: {
                userId: user.UserId,
                name: user.Name,
                email: user.Email,
                phone: user.Phone,
                role: user.Role,
            },
        });
    } catch (error: any) {
        console.error('Register error:', error);
        return res.status(500).json({ message: 'Error registering user', error: error.message });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body as { email?: string; password?: string };

        if (!email || !password) {
            return res.status(400).json({ message: 'Missing required fields: email, password' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await prisma.users.findUnique({ where: { Email: normalizedEmail } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const credentials = await prisma.credentials.findUnique({ where: { UserId: user.UserId } });
        if (!credentials) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const passwordOk = await bcrypt.compare(password, credentials.PasswordHash);
        if (!passwordOk) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            {
                userId: user.UserId,
                orgId: user.OrgId,
                role: user.Role,
                email: user.Email,
                name: user.Name,
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                userId: user.UserId,
                name: user.Name,
                email: user.Email,
                phone: user.Phone,
                role: user.Role,
                orgId: user.OrgId,
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

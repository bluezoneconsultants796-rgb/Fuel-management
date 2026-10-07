
import { Response } from 'express';
import { AuthRequest } from '../types';
import * as authService from '../services/auth.service';

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, password } = req.body as {
    email: string;
    password: string;
  };

  const result = await authService.login(
    email,
    password,
    req.ip ?? 'unknown'
  );

  res.status(200).json({
    success: true,
    message: 'Logged in successfully.',
    data: {
      token: result.token,
      user: result.user
    }
  });
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const profile = await authService.getProfile(req.user!);

  res.status(200).json({
    success: true,
    data: profile
  });
}

export async function logout(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
}

export async function changePassword(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  await authService.changePassword(
    req.user!,
    currentPassword,
    newPassword
  );

  res.status(200).json({
    success: true,
    message:
      'Password updated successfully. Use your new password the next time you log in.'
  });
}

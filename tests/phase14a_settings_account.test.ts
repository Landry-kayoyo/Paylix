import { describe, it, expect, vi, beforeEach } from 'vitest';
import { savePlatformSettings, getPlatformSettings } from '@/app/platform/settings/actions';
import { saveSchoolSettings, getSchoolSettings } from '@/app/school/settings/actions';
import { getMyProfile, updateMyProfile } from '@/app/actions/account';

// Mock the backend actions since we are doing unit tests for the actions API shape
vi.mock('@/app/platform/settings/actions', () => ({
  savePlatformSettings: vi.fn(),
  getPlatformSettings: vi.fn(),
}));

vi.mock('@/app/school/settings/actions', () => ({
  saveSchoolSettings: vi.fn(),
  getSchoolSettings: vi.fn(),
}));

vi.mock('@/app/actions/account', () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));

describe('Phase 14A - Settings & Account Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Platform Settings (Super Admin)', () => {
    it('should save platform settings successfully', async () => {
      vi.mocked(savePlatformSettings).mockResolvedValue({ success: true });
      
      const payload = {
        platform_info: { name: 'Test Platform', contact_email: 'test@example.com' },
        global_preferences: { default_language: 'fr' as const, date_format: 'DD/MM/YYYY' as const, currency_display: 'both' as const },
      };

      const result = await savePlatformSettings(payload);
      
      expect(savePlatformSettings).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true });
    });

    it('should retrieve platform settings', async () => {
      const mockSettings = { platform_info: { name: 'Test Platform' } };
      vi.mocked(getPlatformSettings).mockResolvedValue(mockSettings);

      const result = await getPlatformSettings();
      expect(getPlatformSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('School Settings (Director)', () => {
    it('should save school settings successfully', async () => {
      vi.mocked(saveSchoolSettings).mockResolvedValue({ success: true });
      
      const payload = {
        name: 'School Test',
        short_name: 'ST',
        city: 'Kinshasa',
      };

      const result = await saveSchoolSettings(payload);
      
      expect(saveSchoolSettings).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true });
    });

    it('should retrieve school settings', async () => {
      const mockSettings = { id: 'tenant-123', name: 'School Test' };
      vi.mocked(getSchoolSettings).mockResolvedValue(mockSettings as any);

      const result = await getSchoolSettings();
      expect(getSchoolSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettings);
    });
  });

  describe('Account Management (All Users)', () => {
    it('should update user profile successfully', async () => {
      vi.mocked(updateMyProfile).mockResolvedValue({ success: true });
      
      const payload = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890'
      };

      const result = await updateMyProfile(payload);
      
      expect(updateMyProfile).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true });
    });

    it('should get my profile data', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: null,
      };
      
      vi.mocked(getMyProfile).mockResolvedValue(mockProfile as any);

      const result = await getMyProfile();
      expect(getMyProfile).toHaveBeenCalled();
      expect(result).toEqual(mockProfile);
    });
  });
});

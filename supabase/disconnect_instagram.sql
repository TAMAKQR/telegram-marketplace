-- Отключить Instagram для текущего пользователя
UPDATE influencer_profiles
SET 
    instagram_connected = false,
    instagram_access_token = NULL,
    instagram_token_expires_at = NULL,
    instagram_user_id = NULL,
    instagram_username = NULL,
    instagram_url = NULL,
    updated_at = NOW()
WHERE user_id = '5810d4a0-2b99-4056-bf4d-14733370562d';

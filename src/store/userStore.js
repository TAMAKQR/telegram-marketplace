import { create } from 'zustand'

export const useUserStore = create((set, get) => ({
    userType: null, // 'client' или 'influencer'
    profile: null,
    setUserType: (type) => set({ userType: type }),
    setProfile: (profile) => set({ profile }),
    updateProfile: (updates) => set({
        profile: { ...get().profile, ...updates }
    }),
    clearUser: () => set({ userType: null, profile: null })
}))

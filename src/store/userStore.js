import { create } from 'zustand'

export const useUserStore = create((set) => ({
    userType: null, // 'client' или 'influencer'
    profile: null,
    setUserType: (type) => set({ userType: type }),
    setProfile: (profile) => set({ profile }),
    clearUser: () => set({ userType: null, profile: null })
}))

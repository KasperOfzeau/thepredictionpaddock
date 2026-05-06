'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const AVATAR_BUCKET = 'avatars'
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB (original; after compression much smaller)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const AVATAR_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.15,
  maxWidthOrHeight: 400,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
}

const supabase = createClient()

const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/40 focus:border-f1-red focus:outline-none focus:ring-2 focus:ring-f1-red'

const textareaClass =
  'w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/40 focus:border-f1-red focus:outline-none focus:ring-2 focus:ring-f1-red min-h-[100px]'

const MAX_BIO_LENGTH = 500

interface Profile {
  id: string
  email: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio?: string | null
}

interface SettingsFormProps {
  user: User
  profile: Profile | null
}

export default function SettingsForm({ user, profile }: SettingsFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio?.trim() === '' ? '' : (profile?.bio ?? ''))
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setUsername(profile.username || '')
    setAvatarUrl(profile.avatar_url ?? null)
    setBio(profile.bio?.trim() === '' || profile.bio == null ? '' : profile.bio)
  }, [profile])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(username)) {
      setError('Username must be 3-20 characters (letters, numbers, underscore only)')
      setLoading(false)
      return
    }

    if (bio.length > MAX_BIO_LENGTH) {
      setError(`Bio must be at most ${MAX_BIO_LENGTH} characters`)
      setLoading(false)
      return
    }

    if (username.toLowerCase() !== profile?.username?.toLowerCase()) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.toLowerCase())
        .neq('id', user.id)
        .single()

      if (existingUser) {
        setError('This username is already taken')
        setLoading(false)
        return
      }
    }

    const bioTrimmed = bio.trim()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        username: username.toLowerCase(),
        avatar_url: avatarUrl || null,
        bio: bioTrimmed === '' ? null : bioTrimmed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess('Profile updated successfully!')
    setAvatarPreview(null)
    router.refresh()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, GIF or WebP image.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Image must be smaller than 2MB.')
      return
    }

    setError(null)
    setUploadingAvatar(true)

    let fileToUpload: File
    try {
      const imageCompression = (await import('browser-image-compression')).default
      fileToUpload = await imageCompression(file, AVATAR_COMPRESSION_OPTIONS)
    } catch {
      setUploadingAvatar(false)
      e.target.value = ''
      setError('Could not resize image. Try a different photo.')
      return
    }

    const path = `${user.id}/avatar.jpg`

    const { data: existingFiles } = await supabase.storage.from(AVATAR_BUCKET).list(user.id)
    if (existingFiles?.length) {
      const toRemove = existingFiles.map((f) => `${user.id}/${f.name}`)
      await supabase.storage.from(AVATAR_BUCKET).remove(toRemove)
    }

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, fileToUpload, { upsert: true, contentType: 'image/jpeg' })

    setUploadingAvatar(false)
    e.target.value = ''

    if (uploadError) {
      setError(uploadError.message)
      return
    }

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`)
    setAvatarPreview(URL.createObjectURL(fileToUpload))
  }

  const displayAvatarUrl = avatarPreview || avatarUrl

  return (
    <form onSubmit={handleUpdateProfile} className="space-y-8">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-white/90">Profile picture</label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/10">
            {displayAvatarUrl ? (
              <Image
                src={displayAvatarUrl}
                alt="Profile"
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold text-white/45">
                {username?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Upload profile picture"
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex w-fit items-center justify-center rounded-full border-2 border-f1-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-f1-red/20 disabled:opacity-50"
            >
              {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
            </button>
            <p className="text-xs text-white/45">JPEG, PNG, GIF or WebP. Max 2MB.</p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-white/90">
          Email
        </label>
        <input
          id="email"
          type="email"
          disabled
          value={user.email}
          className="w-full cursor-not-allowed rounded-lg border border-white/10 bg-white/3 px-3 py-2.5 text-white/40"
        />
        <p className="mt-1 text-xs text-white/45">Email cannot be changed</p>
      </div>

      <div>
        <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-white/90">
          Full name
        </label>
        <input
          id="full-name"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
          placeholder="Your full name"
        />
      </div>

      <div>
        <label htmlFor="username" className="mb-2 block text-sm font-medium text-white/90">
          Username
        </label>
        <input
          id="username"
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          pattern="[a-zA-Z0-9_]{3,20}"
          className={inputClass}
          placeholder="your_username"
        />
        <p className="mt-1 text-xs text-white/45">3-20 characters, letters, numbers, and underscore only</p>
      </div>

      <div>
        <label htmlFor="bio" className="mb-2 block text-sm font-medium text-white/90">
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={MAX_BIO_LENGTH}
          rows={5}
          className={textareaClass}
          placeholder="A short line about you — shown on your public profile."
        />
        <p className="mt-1 text-xs text-white/45">
          {bio.length}/{MAX_BIO_LENGTH} characters · visible to everyone who opens your profile
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-full bg-f1-red px-6 py-2.5 font-semibold text-white transition-colors hover:bg-f1-red-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/profile')}
          className="rounded-full border border-white/15 px-6 py-2.5 font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

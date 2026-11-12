/* eslint-disable no-unused-vars */
import React from 'react';
import { Trash2 } from 'lucide-react';
import { ProfileItem } from './resumeTypes';

export type ProfileField = 'network' | 'username' | 'url';

export interface SocialProfileItemProps {
  profile: ProfileItem;
  index: number;
  onUpdate: (field: ProfileField, val: string) => void;
  onRemove: () => void;
}

export const SocialProfileItem: React.FC<SocialProfileItemProps> = ({
  profile,
  index,
  onUpdate,
  onRemove,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '120px 140px 1fr auto',
      gap: '0.45rem',
      alignItems: 'center',
    }}
  >
    <label htmlFor={`profile-${index}-network`} style={{ display: 'none' }}>
      Platform / Network
    </label>
    <input
      id={`profile-${index}-network`}
      aria-label="Platform / Network"
      type="text"
      value={profile.network ?? ''}
      onChange={(e) => {
        onUpdate('network', e.target.value);
      }}
      placeholder="e.g. GitHub"
      className="input-text"
      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
    />

    <label htmlFor={`profile-${index}-username`} style={{ display: 'none' }}>
      Username / Handle
    </label>
    <input
      id={`profile-${index}-username`}
      aria-label="Username / Handle"
      type="text"
      value={profile.username ?? ''}
      onChange={(e) => {
        onUpdate('username', e.target.value);
      }}
      placeholder="Username"
      className="input-text"
      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
    />

    <label htmlFor={`profile-${index}-url`} style={{ display: 'none' }}>
      Profile URL
    </label>
    <input
      id={`profile-${index}-url`}
      aria-label="Profile URL"
      type="url"
      value={profile.url ?? ''}
      onChange={(e) => {
        onUpdate('url', e.target.value);
      }}
      placeholder="https://github.com/..."
      className="input-text"
      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
    />

    <button
      type="button"
      onClick={() => {
        onRemove();
      }}
      className="btn btn-danger btn-sm"
      style={{ padding: '0.2rem 0.4rem' }}
      title="Delete profile"
      aria-label={`Delete profile ${profile.network ?? index + 1}`}
    >
      <Trash2 size={12} />
    </button>
  </div>
);

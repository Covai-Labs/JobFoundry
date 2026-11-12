/* eslint-disable no-unused-vars */
import React from 'react';
import { User, Plus } from 'lucide-react';
import { BasicsItem, ProfileItem } from './resumeTypes';
import { CollapsibleSection } from './CollapsibleSection';
import { SocialProfileItem, ProfileField } from './SocialProfileItem';

export type BasicField = 'name' | 'label' | 'email' | 'phone' | 'url' | 'summary';
export type LocationField = 'city' | 'region';

export interface BasicsFormSectionProps {
  basics: BasicsItem;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateBasics: (field: BasicField, value: string) => void;
  onUpdateLocation: (field: LocationField, value: string) => void;
  onAddProfile: () => void;
  onUpdateProfile: (index: number, field: ProfileField, value: string) => void;
  onRemoveProfile: (index: number) => void;
}

export const BasicsFormSection: React.FC<BasicsFormSectionProps> = ({
  basics,
  isOpen,
  onToggle,
  onUpdateBasics,
  onUpdateLocation,
  onAddProfile,
  onUpdateProfile,
  onRemoveProfile,
}) => {
  const profiles = Array.isArray(basics.profiles) ? basics.profiles : [];

  return (
    <CollapsibleSection
      id="basics"
      title="Basics & Contact"
      icon={<User size={18} style={{ color: 'var(--accent-primary, #818cf8)' }} />}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label
            htmlFor="basics-name"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Full Name
          </label>
          <input
            id="basics-name"
            type="text"
            value={basics.name ?? ''}
            onChange={(e) => {
              onUpdateBasics('name', e.target.value);
            }}
            placeholder="e.g. Jane Doe"
            className="input-text"
          />
        </div>
        <div>
          <label
            htmlFor="basics-label"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Professional Headline / Title
          </label>
          <input
            id="basics-label"
            type="text"
            value={basics.label ?? ''}
            onChange={(e) => {
              onUpdateBasics('label', e.target.value);
            }}
            placeholder="e.g. Lead Staff Systems Engineer"
            className="input-text"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label
            htmlFor="basics-email"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Email Address
          </label>
          <input
            id="basics-email"
            type="email"
            value={basics.email ?? ''}
            onChange={(e) => {
              onUpdateBasics('email', e.target.value);
            }}
            placeholder="jane@example.com"
            className="input-text"
          />
        </div>
        <div>
          <label
            htmlFor="basics-phone"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Phone Number
          </label>
          <input
            id="basics-phone"
            type="tel"
            value={basics.phone ?? ''}
            onChange={(e) => {
              onUpdateBasics('phone', e.target.value);
            }}
            placeholder="+1 555-0199"
            className="input-text"
          />
        </div>
        <div>
          <label
            htmlFor="basics-url"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Personal Website / Portfolio
          </label>
          <input
            id="basics-url"
            type="url"
            value={basics.url ?? ''}
            onChange={(e) => {
              onUpdateBasics('url', e.target.value);
            }}
            placeholder="https://janedoe.dev"
            className="input-text"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label
            htmlFor="basics-city"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            City
          </label>
          <input
            id="basics-city"
            type="text"
            value={basics.location?.city ?? ''}
            onChange={(e) => {
              onUpdateLocation('city', e.target.value);
            }}
            placeholder="San Francisco"
            className="input-text"
          />
        </div>
        <div>
          <label
            htmlFor="basics-region"
            style={{
              fontSize: '0.78rem',
              fontWeight: 500,
              display: 'block',
              marginBottom: '0.25rem',
            }}
          >
            Region / State / Country
          </label>
          <input
            id="basics-region"
            type="text"
            value={basics.location?.region ?? ''}
            onChange={(e) => {
              onUpdateLocation('region', e.target.value);
            }}
            placeholder="California, USA"
            className="input-text"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="basics-summary"
          style={{
            fontSize: '0.78rem',
            fontWeight: 500,
            display: 'block',
            marginBottom: '0.25rem',
          }}
        >
          Professional Summary / Bio
        </label>
        <textarea
          id="basics-summary"
          value={basics.summary ?? ''}
          onChange={(e) => {
            onUpdateBasics('summary', e.target.value);
          }}
          placeholder="Seasoned engineer with 8+ years building distributed platforms..."
          rows={3}
          className="input-text"
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Social Profiles */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
            Social & Professional Profiles ({profiles.length})
          </span>
          <button
            type="button"
            onClick={onAddProfile}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
          >
            <Plus size={12} /> Add Profile
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {profiles.map((prof: ProfileItem, pIdx: number) => (
            <SocialProfileItem
              key={pIdx}
              profile={prof}
              index={pIdx}
              onUpdate={(field, val) => {
                onUpdateProfile(pIdx, field, val);
              }}
              onRemove={() => {
                onRemoveProfile(pIdx);
              }}
            />
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
};

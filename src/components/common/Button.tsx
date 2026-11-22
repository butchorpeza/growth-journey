import type { AnchorHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'link';

export function ButtonLink({ variant = 'primary', children, external, ...rest }:
  AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; children: ReactNode; external?: boolean }) {
  return (
    <a className={`btn btn--${variant}`} {...(external ? { target: '_blank', rel: 'noopener' } : {})} {...rest}>
      <span>{children}</span>
      {variant !== 'link' && <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><path d="M2.5 8h11m0 0L9 3.5M13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </a>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';
import { Button } from '../features/shared/components/Button';
import { acceptTerms } from '../utils/localStorage';

const termsItems = [
  'You must be authorized to access any repository, workspace, or file connected to this product.',
  'AI output must be reviewed by a human before production use.',
  'Risky actions can create logs and audit records for safety.',
  'Do not include secrets in prompts, files, or tool inputs.',
];

export default function TermsAgreementPage() {
  const navigate = useNavigate();

  const handleContinue = () => {
    acceptTerms();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 text-on-surface">
      <div className="w-full max-w-2xl rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-7 shadow-sm md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-on-surface">Terms and conditions</h1>
            <p className="text-sm text-on-surface-variant">You must accept before continuing to sign in.</p>
          </div>
        </div>

        <ul className="space-y-3">
          {termsItems.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-on-surface-variant">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <Button onClick={handleContinue} size="lg" className="mt-7 w-full rounded-xl" trailingIcon={ArrowRight}>
          I agree, continue to sign in
        </Button>
      </div>
    </div>
  );
}

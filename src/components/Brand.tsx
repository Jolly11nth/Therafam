import logo from '../assets/brand/Therafam 1.png';

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'brand-lockup compact' : 'brand-lockup'}>
      <img src={logo} alt="Therafam" className="therafam-logo" />
    </span>
  );
}

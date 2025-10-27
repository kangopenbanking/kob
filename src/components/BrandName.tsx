interface BrandNameProps {
  className?: string;
}

export const BrandName = ({ className = "" }: BrandNameProps) => {
  return (
    <span className={`font-bold ${className}`}>
      Kang <span style={{ color: '#9fe870' }}>Open</span> Banking
    </span>
  );
};

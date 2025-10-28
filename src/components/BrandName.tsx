interface BrandNameProps {
  className?: string;
}

export const BrandName = ({ className = "" }: BrandNameProps) => {
  return (
    <span className={`font-bold ${className}`}>
      <span className="text-primary">OPEN</span> BANKING
    </span>
  );
};

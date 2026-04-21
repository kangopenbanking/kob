interface BrandNameProps {
  className?: string;
}

export const BrandName = ({ className = "" }: BrandNameProps) => {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <span className="font-bold">
        <span className="text-primary">Kang</span> Open Banking
      </span>
      <span className="text-[0.5em] font-normal text-foreground tracking-wider -mt-1">
        BUILD THE FUTURE OF FINANCE
      </span>
    </div>
  );
};

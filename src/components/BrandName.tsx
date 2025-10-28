interface BrandNameProps {
  className?: string;
}

export const BrandName = ({ className = "" }: BrandNameProps) => {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <span className="font-bold">
        <span className="text-primary">OPEN</span> BANKING
      </span>
      <span className="text-[0.5em] font-normal text-foreground tracking-wider -mt-1">
        Kang Standard for Innovation
      </span>
    </div>
  );
};

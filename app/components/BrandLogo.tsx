import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      alt="WishBottle"
      className={`brand-logo-image ${className}`.trim()}
      height={1240}
      priority={priority}
      sizes="(max-width: 480px) 88px, 104px"
      src="/assets/wishbottle-logo-cream.jpg"
      width={1240}
    />
  );
}

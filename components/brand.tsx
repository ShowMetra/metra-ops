import Image from "next/image";
import Link from "next/link";

type BrandProps = {
  href?: string;
  className?: string;
};

function BrandContent() {
  return <>
    <Image className="brandMark" src="/brand/remarc-mark.svg" alt="" width={40} height={40} unoptimized />
    <span className="brandText"><span>Remarc</span><small>Entertainment</small></span>
  </>;
}

export function Brand({ href, className = "" }: BrandProps) {
  const classes = ["brand", className].filter(Boolean).join(" ");
  if (href) return <Link href={href} className={classes} aria-label="Remarc Entertainment home"><BrandContent /></Link>;
  return <div className={classes}><BrandContent /></div>;
}

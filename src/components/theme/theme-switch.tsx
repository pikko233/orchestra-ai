import { ReactNode } from "react";
import { Button } from "../ui/button";

interface ThemeSwitchProps {
  icon: ReactNode;
  isActive: boolean;
  onClick: () => void;
}

export const ThemeSwitch = ({ icon, isActive, onClick }: ThemeSwitchProps) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };
  return (
    <Button
      variant={isActive ? "default" : "ghost"}
      size="icon"
      onClick={handleClick}
      className="rounded-full h-6 w-6"
    >
      {icon}
    </Button>
  );
};

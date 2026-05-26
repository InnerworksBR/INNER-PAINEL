import { Menu } from "lucide-react";

const MobileHeader = ({ onMenuClick, title = "Painel" }) => {
    return (
        <div className="md:hidden flex items-center justify-between bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-md">
            <h1 className="text-lg font-semibold">{title}</h1>
            <button 
                onClick={onMenuClick} 
                className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition-colors focus:outline-none"
                aria-label="Abrir menu"
            >
                <Menu size={24} />
            </button>
        </div>
    );
};

export default MobileHeader;

import Image from "next/image";
import "./nav.css";

export default function Navbar() {
    return(
        <>
        <div className="navbarContainer">
            <div className="navLogoAndText">
                <Image
                    src="/branding/logo.svg"
                    alt="Spending and nutrition shown side by side"
                    width={310}
                    height={310}
                    className="navLogoImage"
                />
                <span className="navBrandName">MOSAIC</span>
            </div>
            <div className="navHamburgerMenuContainer">
                <span className="topLine"></span>
                <span className="midLine"></span>
                <span className="bottomLine"></span>
            </div>
        </div>

        </>
    );
}
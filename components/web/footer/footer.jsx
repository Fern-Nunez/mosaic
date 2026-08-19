import Image from "next/image";
import "./footer.css";

export default function Footer() {
    return (
        <>
        <div className="footerContainer">
            <div className="footerLogoAndText">
                <Image
                    src="/branding/logo.svg"
                    alt="Spending and nutrition shown side by side"
                    width={310}
                    height={310}
                    className="logoImage"
                />
                <span className="brandName">MOSAIC</span>
            </div>
            <div className="footerContentSection">
                <div className="footerSection">
                    <div className="footerTitle">
                        <h3>Navigation</h3>
                    </div>
                    <div className="footerContent">
                        <span>Home</span>
                        <span>Dashboard</span>
                        <span>Log In</span>
                        <span>Sign Up</span>
                        <span>Newsletter</span>
                    </div>
                </div>
                <div className="footerSection">
                    <div className="footerTitle">
                        <h3>Legal</h3>
                    </div>
                    <div className="footerContent">
                        <span>Privacy Policy</span>
                        <span>Terms of Service</span>
                    </div>
                </div>
            </div>
            <div className="MBranding">
                <span className="MBrandingText">Designed by Monoscale</span>
            </div>
        </div>
        </>
    );
}
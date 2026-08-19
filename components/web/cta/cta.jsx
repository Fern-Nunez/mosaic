import HPButton from "../homepageButton/HPButton";
import "./cta.css";

export default function CTA() {
  return (
    <>
    <div className="ctaContainer">
        <div className="ctaTextContainer">
            <h1>Your Life's <br/>Already a Mosaic.</h1>
            <p>Start Piecing it Together.</p>
            <div className="ctaButtonContainer">
                <HPButton/>
            </div>
        </div>
    </div>
    </>
  );
}
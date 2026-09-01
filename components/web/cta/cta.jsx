import HPButton from "../homepageButton/HPButton";
import "./cta.css";
import GlassShards from "@/components/web/glass/glassShards";
import Reveal from "@/components/web/reveal/reveal";

export default function CTA() {
  return (
    <>
    <div className="ctaContainer">
      <div className="ctaGlass">
        <GlassShards eager preset="prismMosaic" fit="cover" zoom={1.75} offsetY={-0.22} offsetX={0.025} idle={0.2} speed={0.2} tilt={0.02} mobile={{ zoom: 2, tilt: 0.02, maxDpr: 1.25, speed: 1, idle: 0.2, offsetY: -0.05 }}/>
      </div>
        <Reveal className="ctaTextContainer">
            <h1>Your Life's <br/>Already a Mosaic.</h1>
            <p className="ctaDesc">Start Piecing it Together.</p>
            <div className="ctaButtonContainer">
                <HPButton/>
            </div>
        </Reveal>
    </div>
    </>
  );
}
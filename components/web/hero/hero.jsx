import Link from "next/link";
import "./hero.css";
import HPButton from "../homepageButton/HPButton";
import GlassShards from "@/components/web/glass/glassShards";
import Reveal from "@/components/web/reveal/reveal";

export default function Hero() {
  return (
    <div className="heroContainer">
      <div className="heroGlass">
        <div style={{ position: "absolute", top: "-45%", left: "-40%", width: "100%", height: "100%" }}>
          <GlassShards preset="prism" seed={7} coreColor="#66d9ff" zoom={0.8} idle={1.6}/>
        </div>
        <div style={{ position: "absolute", top: "-50%", right: "-45%", width: "100%", height: "100%" }}>
          <GlassShards preset="prism" seed={31} coreColor="#ff7ac2" rimColor="#ff7ac2" zoom={0.6} idle={1.6}/>
        </div>
        <div style={{ position: "absolute", bottom: "-24%", left: "40%", width: "100%", height: "100%" }}>
          <GlassShards preset="prism" seed={9872} coreColor="#9dff7a" zoom={0.85} idle={1.6} mobile={{zoom: 1, offsetY: 1.1, offsetX: 0.1}}/>
        </div>
      </div>

      <div className="heroNavContainer"></div>

      <Reveal className="heroTextContainer" waitForLoader>
        <h1>Start Piecing your <br/>Life Together</h1>
        <div className="heroDescriptionText">
          <p>Every expense, workout, calorie, journal entry, habit, project, and goal — all connected in one place.</p>
        </div>
        <div className="buttonContainer">
          <Link href={"/dashboard"}>
            <HPButton/>
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
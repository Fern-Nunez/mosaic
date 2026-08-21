import Link from "next/link";
import "./hero.css";
import HPButton from "../homepageButton/HPButton";

export default function Hero() {
  return (
    <>
    <div className="heroContainer">
        <div className="heroNavContainer">

        </div>
        <div className="heroTextContainer">
            <h1>Start Piecing your <br/>Life Together</h1>
            <div className="heroDescriptionText">
                <p>Every expense, workout, calorie, journal entry, habit, project, and goal — all connected in one place.</p>
            </div>
            <div className="buttonContainer">
                <Link href={"/dashboard"}>
                    <HPButton/>
                </Link>
                
            </div>
            
        </div>
    </div>
    </>
  );
}
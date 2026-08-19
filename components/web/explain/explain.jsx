import Image from "next/image";
import "./explain.css";

export default function Explain() {
  return (
    <>
    <div className="explainContainer">
        <div className="explainSectionContainer">
            <div className="explainSection">
                <div className="explainTextContainer">
                    <h2>Does your spending show up in what you eat?</h2>
                    <p>Money and nutrition side by side — see when tight-budget weeks and takeout weeks line up.</p>
                </div>
                <div className="explainSectionImage">
                    <Image
                        src="/images/homepage/placeholder.jpg"
                        alt="Spending and nutrition shown side by side"
                        width={735}
                        height={478}
                        className="explainImage"
                    />
                </div>
            </div>

            <div className="explainSectionMid">
                <div className="explainTextContainer">
                    <h2>Watch your food, training, and mood move together.</h2>
                    <p>Money and nutrition side by side — see when tight-budget weeks and takeout weeks line up.</p>
                </div>
                <div className="explainSectionImage">
                    <Image
                        src="/images/homepage/placeholder.jpg"
                        alt="Spending and nutrition shown side by side"
                        width={735}
                        height={478}
                        className="explainImage"
                    />
                </div>               
            </div>

            <div className="explainSection">
                <div className="explainTextContainer">
                    <h2>Find out where your habits really come from.</h2>
                    <p>Line your habits up against your mood and mornings to see what's actually driving them.</p>
                </div>
                <div className="explainSectionImage">
                    <Image
                        src="/images/homepage/placeholder.jpg"
                        alt="Spending and nutrition shown side by side"
                        width={735}
                        height={478}
                        className="explainImage"
                    />
                </div>              
            </div>
        </div>

        <div className="finalExplain">
            <p>Every entry is one more dot on the canvas. Day by day the picture fills in — your habits, your progress, your growth — until you can finally see how far you've come.</p>
        </div>
    </div>
    </>
  );
}
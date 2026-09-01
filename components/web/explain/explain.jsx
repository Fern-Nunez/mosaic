import Image from "next/image";
import "./explain.css";
import Reveal from "@/components/web/reveal/reveal";
import ReadingReveal from "@/components/web/reveal/readingReveal";

export default function Explain() {
  return (
    <>
    <div className="explainContainer">
        <div className="explainSectionContainer">
            <div className="explainSection">
                <Reveal className="explainTextContainer">
                    <h2>See what your weight was actually responding to.</h2>
                    <p>Training and calories on the same timeline — the month it moved has a cause, and causes repeat.</p>
                </Reveal>
                <Reveal className="explainSectionImage" delay={0.45}>
                    <Image
                        src="/images/homepage/placeholder.jpg"
                        alt="Spending and nutrition shown side by side"
                        width={735}
                        height={478}
                        className="explainImage"
                    />
                </Reveal>
            </div>

            <div className="explainSectionMid">
                <Reveal className="explainTextContainer">
                    <h2>Watch your food and your mood move together.</h2>
                    <p>Meals and journal entries side by side — the days you felt worst usually have something in common.</p>
                </Reveal>
                <Reveal className="explainSectionImage" delay={0.45}>
                    <Image
                        src="/images/homepage/placeholder.jpg"
                        alt="Spending and nutrition shown side by side"
                        width={735}
                        height={478}
                        className="explainImage"
                    />
                </Reveal>               
            </div>

            <div className="explainSection">
                <Reveal className="explainTextContainer">
                    <h2>Find out where your habits really come from.</h2>
                    <p>Line your habits up against your mood and mornings to see what's actually driving them.</p>
                </Reveal>
                <Reveal className="explainSectionImage" delay={0.45}>
                    <Image
                        src="/images/homepage/placeholder.jpg"
                        alt="Spending and nutrition shown side by side"
                        width={735}
                        height={478}
                        className="explainImage"
                    />
                </Reveal>              
            </div>
        </div>

        <div className="finalExplain">
            <ReadingReveal>Every entry is one more dot on the canvas. Day by day the picture fills in — your habits, your progress, your growth — until you can finally see how far you've come.</ReadingReveal>
        </div>
    </div>
    </>
  );
}
import "./about.css";

export default function About() {
  return (
    <>
    <div className="aboutContainer" id="about">
        <div className="aboutTextContainer">
            <h2>Does this sound familiar?</h2>
            <div className="aboutDescriptionText">
                <p>A budgeting app here, a calorie counter there, a habit tracker you keep forgetting to open, and a journal buried somewhere in your notes. Five logins, five subscriptions - and still no sense of how any of it actually fits together.</p>
            </div>
        </div>
    </div>
    <div className="aboutContainer">
      <div className="aboutTextContainer">
          <h2>Finally, One Place where Everything is Connected</h2>
          <div className="aboutDescriptionText">
              <p>When your money, food, training, and mood live side by side, the patterns finally show up — the ones no single app can see. How a rough week of sleep drags your lifts. How eating out quietly eats your budget. Mosaic doesn&apos;t just hold your data. It shows you the whole picture.</p>
          </div>
      </div>
    </div>
    </>
  );
}
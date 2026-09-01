import "./home.css";
import Navbar from "@/components/web/nav/nav";
import Hero from "@/components/web/hero/hero";
import About from "@/components/web/about/about";
import Explain from "@/components/web/explain/explain";
import CTA from "@/components/web/cta/cta";
import Footer from "@/components/web/footer/footer";
import Loader from "@/components/web/loader/loader";
import LoaderSignals from "@/components/web/loader/loaderSignals";
import SoundToggle from "@/components/web/sound/soundToggle";

export default function Home() {
  return (
    <div className="mainContainer" data-surface="web">
      {/* Rendered in the server markup, so the black is painted before the
          page is ever visible rather than after hydration. */}
      <Loader />
      <LoaderSignals />
      <Navbar/>
      <Hero/>
      <About/>
      <Explain/>
      <CTA/>
      <Footer/>
      <SoundToggle />
    </div>
  );
}
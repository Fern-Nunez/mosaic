import "./home.css";
import Navbar from "@/components/web/nav/nav";
import Hero from "@/components/web/hero/hero";
import About from "@/components/web/about/about";
import Explain from "@/components/web/explain/explain";
import CTA from "@/components/web/cta/cta";
import Footer from "@/components/web/footer/footer";

export default function Home() {
  return (
    <div className="mainContainer" data-surface="web">
      <Navbar/>
      <Hero/>
      <About/>
      <Explain/>
      <CTA/>
      <Footer/>
    </div>
  );
}
import HeroSection from './sections/HeroSection';
import PainPointsSection from './sections/PainPointsSection';
import MultimodalSection from './sections/MultimodalSection';
import ArchitectureSection from './sections/ArchitectureSection';
import SimulationSection from './sections/SimulationSection';
import TechRouteSection from './sections/TechRouteSection';
import ScenariosSection from './sections/ScenariosSection';
import ClosingSection from './sections/ClosingSection';
import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function HomePage() {
  const location = useLocation();

  // 从其他页面跳回首页时，按导航传入的 scrollTo 滚动到对应区块（HashRouter 下不使用锚点 hash）
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    const timer = window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.state]);

  return (
    <MotionConfig reducedMotion="user"><div className="glass-home min-h-screen">
      <HeroSection />
      <PainPointsSection />
      <MultimodalSection />
      <ArchitectureSection />
      <SimulationSection />
      <TechRouteSection />
      <ScenariosSection />
      <ClosingSection />
    </div></MotionConfig>
  );
}

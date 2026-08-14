'use client';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { ProjectCard } from '@/components/ProjectCard';
import { TrendingUp } from 'lucide-react';

interface ProjectCarouselProps {
  projects: any[];
  canSeeMoney: boolean;
}

export function ProjectCarousel({ projects, canSeeMoney }: ProjectCarouselProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-400" />
        Proyectos
      </h2>

      {projects.length === 0 ? (
        <div className="p-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl text-center">
          <p className="text-slate-400">No hay proyectos aún</p>
          <p className="text-sm text-slate-500 mt-2">
            Envía mensajes por Telegram para crear proyectos
          </p>
        </div>
      ) : (
        <Carousel opts={{ align: 'start', loop: false }} className="px-2">
          <CarouselContent>
            {projects.map((project) => (
              <CarouselItem
                key={project.id}
                className="basis-full md:basis-[42%] lg:basis-[29%]"
              >
                <ProjectCard project={project} canSeeMoney={canSeeMoney} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden lg:flex" />
          <CarouselNext className="hidden lg:flex" />
        </Carousel>
      )}
    </div>
  );
}

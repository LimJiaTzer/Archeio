import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderedWorkspaceFeatures } from '../data/workspaceFeatures';
import WorkspaceJourneyToken from './WorkspaceJourneyToken';

const toolboxCopy = {
  compress: {
    description: 'Shrink large documents and media with controls that help preserve visible quality.',
    detail: '30+ file formats',
  },
  convert: {
    description: 'Convert documents, images, audio, and video without bouncing between different apps.',
    detail: '30+ file formats',
  },
  ocr: {
    description: 'Extract editable text from images and scanned PDFs, then export clean DOCX files.',
    detail: 'Images · Scanned PDFs · DOCX',
  },
  'image-editor': {
    description: 'Crop, draw, add text, apply filters, and export polished images in one workspace.',
    detail: 'Crop · Draw · Filter · Export',
  },
  pdf: {
    description: 'Merge, split, reorder, rotate, annotate, and sign PDF pages in one focused editor.',
    detail: 'Organize · Mark up · Export',
  },
  qr: {
    description: 'Turn links and useful information into polished, scannable QR codes.',
    detail: 'Custom and downloadable',
  },
};

const headingSequenceVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.18,
    },
  },
};

const headingFadeVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const typedHeadingVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.14,
    },
  },
};

const typedLineVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.075,
    },
  },
};

const typedWordVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.028,
    },
  },
};

const typedCharacterVariants = {
  hidden: {
    opacity: 0,
    y: '0.28em',
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const toolGridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const toolCardVariants = {
  hidden: {
    opacity: 0,
    y: 76,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function TypedLine({ text, showCaret = false }) {
  return (
    <motion.span className="section-type-line" variants={typedLineVariants}>
      {text.split(' ').map((word, wordIndex, words) => (
        <span key={`${word}-${wordIndex}`}>
          <motion.span className="section-type-word" variants={typedWordVariants}>
            {Array.from(word).map((character, characterIndex) => (
              <motion.span
                className="section-type-character"
                variants={typedCharacterVariants}
                key={`${character}-${characterIndex}`}
              >
                {character}
              </motion.span>
            ))}
          </motion.span>
          {wordIndex < words.length - 1 ? ' ' : ''}
        </span>
      ))}
      {showCaret && (
        <motion.span
          className="section-type-caret"
          variants={typedCharacterVariants}
          aria-hidden="true"
        />
      )}
    </motion.span>
  );
}

function TypedToolboxHeading() {
  return (
    <motion.h2
      id="home-toolbox-title"
      aria-label="From “I have this” to “I need that.”"
      variants={typedHeadingVariants}
    >
      <span aria-hidden="true">
        <TypedLine text="From “I have this” to" />
        <TypedLine text="“I need that.”" showCaret />
      </span>
    </motion.h2>
  );
}

function ToolCard({ feature, iconPhase, reducedMotion }) {
  const copy = toolboxCopy[feature.id];

  return (
    <motion.div className="tool-card-motion" variants={toolCardVariants}>
      <Link to={feature.href} className="tool-card group">
        <div className="tool-token-slot" aria-hidden="true">
          {iconPhase === 'toolbox' && (
            <WorkspaceJourneyToken
              feature={feature}
              layoutId={
                reducedMotion ? undefined : `home-workspace-token-${feature.id}`
              }
              phase="toolbox"
              reducedMotion={reducedMotion}
            />
          )}
        </div>
        <div className="min-w-0">
          <h3>{feature.title}</h3>
          <p>{copy.description}</p>
        </div>
        <div className="tool-card-footer">
          <span>{copy.detail}</span>
          <span className="tool-card-arrow" aria-hidden="true">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function HomeToolboxGrid({ iconPhase }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="tools"
      className="scroll-mt-32 px-6 py-24 lg:px-10"
      aria-labelledby="home-toolbox-title"
    >
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="section-heading"
          variants={headingSequenceVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.55 }}
        >
          <div>
            <motion.span className="section-label" variants={headingFadeVariants}>
              THE TOOLBOX
            </motion.span>
            <TypedToolboxHeading />
          </div>
          <motion.p variants={headingFadeVariants}>
            Pick the output you need. Archeío handles the formats,
            previews, and exports in one consistent flow.
          </motion.p>
        </motion.div>

        <motion.div
          className="tools-grid mt-12"
          variants={toolGridVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.12 }}
        >
          {orderedWorkspaceFeatures.map((feature) => (
            <ToolCard
              feature={feature}
              iconPhase={iconPhase}
              reducedMotion={shouldReduceMotion}
              key={feature.id}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

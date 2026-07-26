import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Layers3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { orderedWorkspaceFeatures } from '../data/workspaceFeatures';

const toolboxDetails = {
  compress: '30+ file formats',
  convert: '30+ file formats',
  ocr: 'Images · Scanned PDFs · DOCX',
  'image-editor': 'Crop · Draw · Filter · Export',
  pdf: 'Organize · Mark up · Export',
  qr: 'Custom · Scan-ready · Export',
};

const headingVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.16,
    },
  },
};

const lineVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.025,
    },
  },
};

const characterVariants = {
  hidden: {
    opacity: 0,
    y: '0.24em',
    filter: 'blur(3px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.16,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const MotionLink = motion.create(Link);

function TypedLine({ text, caret = false }) {
  return (
    <motion.span className="home-toolbox-heading-line" variants={lineVariants}>
      {Array.from(text).map((character, index) => (
        <motion.span
          className="home-toolbox-heading-character"
          variants={characterVariants}
          key={`${character}-${index}`}
        >
          {character === ' ' ? '\u00a0' : character}
        </motion.span>
      ))}
      {caret && <span className="home-toolbox-heading-caret" aria-hidden="true" />}
    </motion.span>
  );
}

export default function HomeToolboxGrid() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="tools"
      className="home-toolbox-section"
      aria-labelledby="home-toolbox-title"
    >
      <div className="home-toolbox-heading">
        <motion.div
          variants={headingVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className="section-label">THE TOOLBOX</span>
          <motion.h2 id="home-toolbox-title" aria-label="From “I have this” to “I need that.”">
            <span aria-hidden="true">
              <TypedLine text="From “I have this” to" />
              <TypedLine text="“I need that.”" caret />
            </span>
          </motion.h2>
        </motion.div>

        <p>
          Pick the output you need. Archeío handles the formats, previews, and
          exports in one consistent flow.
        </p>
      </div>

      <div className="home-toolbox-grid">
        {orderedWorkspaceFeatures.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <MotionLink
              to={feature.href}
              className="home-toolbox-card"
              data-tone={feature.tone}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 64 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.16 }}
              transition={{
                delay: index * 0.07,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              key={feature.id}
            >
              <span className="home-toolbox-card-icon">
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>

              <div>
                <span className="home-toolbox-card-kicker">{feature.kicker}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>

              <div className="home-toolbox-card-footer">
                <span>
                  <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {toolboxDetails[feature.id]}
                </span>
                <span className="home-toolbox-card-arrow" aria-hidden="true">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </MotionLink>
          );
        })}
      </div>
    </section>
  );
}

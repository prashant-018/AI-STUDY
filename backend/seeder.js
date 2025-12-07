import 'dotenv/config';
import mongoose from 'mongoose';
import Question from './src/models/Question.js';
import connectDB from './src/config/db.js';

// Sample questions data
const sampleQuestions = [
  {
    question: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctAnswer: 2,
    explanation: 'Paris is the capital and largest city of France.',
    subject: 'Geography',
    category: 'World Capitals',
    difficulty: 'easy',
    tags: ['geography', 'europe', 'capitals'],
    points: 10,
    timeLimit: 30,
  },
  {
    question: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: 1,
    explanation: 'Basic addition: 2 + 2 = 4',
    subject: 'Mathematics',
    category: 'Basic Math',
    difficulty: 'easy',
    tags: ['math', 'addition', 'basic'],
    points: 10,
    timeLimit: 20,
  },
  {
    question: 'What is the chemical symbol for water?',
    options: ['H2O', 'CO2', 'O2', 'NaCl'],
    correctAnswer: 0,
    explanation: 'Water is composed of two hydrogen atoms and one oxygen atom, hence H2O.',
    subject: 'Chemistry',
    category: 'Chemical Formulas',
    difficulty: 'medium',
    tags: ['chemistry', 'formulas', 'water'],
    points: 15,
    timeLimit: 45,
  },
  {
    question: 'Who wrote "Romeo and Juliet"?',
    options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
    correctAnswer: 1,
    explanation: 'William Shakespeare wrote the famous tragedy "Romeo and Juliet" in the late 16th century.',
    subject: 'Literature',
    category: 'Classic Literature',
    difficulty: 'medium',
    tags: ['literature', 'shakespeare', 'classics'],
    points: 15,
    timeLimit: 40,
  },
  {
    question: 'What is the speed of light in vacuum?',
    options: [
      '300,000 km/s',
      '150,000 km/s',
      '450,000 km/s',
      '200,000 km/s',
    ],
    correctAnswer: 0,
    explanation: 'The speed of light in vacuum is approximately 299,792,458 meters per second, or about 300,000 km/s.',
    subject: 'Physics',
    category: 'Optics',
    difficulty: 'hard',
    tags: ['physics', 'light', 'constants'],
    points: 20,
    timeLimit: 60,
  },
  {
    question: 'What is the largest planet in our solar system?',
    options: ['Earth', 'Saturn', 'Jupiter', 'Neptune'],
    correctAnswer: 2,
    explanation: 'Jupiter is the largest planet in our solar system, with a mass greater than all other planets combined.',
    subject: 'Astronomy',
    category: 'Solar System',
    difficulty: 'medium',
    tags: ['astronomy', 'planets', 'solar-system'],
    points: 15,
    timeLimit: 45,
  },
  {
    question: 'What is the square root of 64?',
    options: ['6', '7', '8', '9'],
    correctAnswer: 2,
    explanation: 'The square root of 64 is 8, because 8 × 8 = 64.',
    subject: 'Mathematics',
    category: 'Algebra',
    difficulty: 'easy',
    tags: ['math', 'square-root', 'algebra'],
    points: 10,
    timeLimit: 30,
  },
  {
    question: 'What is the main component of the Earth\'s atmosphere?',
    options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Argon'],
    correctAnswer: 1,
    explanation: 'Nitrogen makes up approximately 78% of Earth\'s atmosphere, while oxygen is about 21%.',
    subject: 'Science',
    category: 'Earth Science',
    difficulty: 'medium',
    tags: ['science', 'atmosphere', 'earth'],
    points: 15,
    timeLimit: 45,
  },
  {
    question: 'In which year did World War II end?',
    options: ['1943', '1944', '1945', '1946'],
    correctAnswer: 2,
    explanation: 'World War II ended in 1945, with Japan surrendering in September after the atomic bombings.',
    subject: 'History',
    category: 'World Wars',
    difficulty: 'medium',
    tags: ['history', 'world-war-2', '20th-century'],
    points: 15,
    timeLimit: 50,
  },
  {
    question: 'What is the smallest prime number?',
    options: ['0', '1', '2', '3'],
    correctAnswer: 2,
    explanation: '2 is the smallest prime number. It is the only even prime number.',
    subject: 'Mathematics',
    category: 'Number Theory',
    difficulty: 'easy',
    tags: ['math', 'prime-numbers', 'number-theory'],
    points: 10,
    timeLimit: 25,
  },
];

// Seed function
const seedQuestions = async () => {
  try {
    await connectDB();
    console.log('🌱 Starting to seed questions...');

    // Clear existing questions (optional - comment out if you want to keep existing)
    // await Question.deleteMany({});
    // console.log('🗑️  Cleared existing questions');

    // Insert sample questions
    const inserted = await Question.insertMany(sampleQuestions);
    console.log(`✅ Successfully seeded ${inserted.length} questions!`);

    // Display summary
    const counts = await Question.aggregate([
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 },
        },
      },
    ]);

    console.log('\n📊 Questions by Subject:');
    counts.forEach((item) => {
      console.log(`   ${item._id}: ${item.count} questions`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding questions:', error);
    process.exit(1);
  }
};

// Run seeder
seedQuestions();



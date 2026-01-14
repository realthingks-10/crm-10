import { useState } from "react";

const colors = [
  { name: "Red", hex: "#EF4444", bg: "bg-red-500" },
  { name: "Orange", hex: "#F97316", bg: "bg-orange-500" },
  { name: "Yellow", hex: "#EAB308", bg: "bg-yellow-500" },
  { name: "Green", hex: "#22C55E", bg: "bg-green-500" },
  { name: "Blue", hex: "#3B82F6", bg: "bg-blue-500" },
  { name: "Purple", hex: "#A855F7", bg: "bg-purple-500" },
  { name: "Pink", hex: "#EC4899", bg: "bg-pink-500" },
  { name: "Cyan", hex: "#06B6D4", bg: "bg-cyan-500" },
];

const ColorSelector = () => {
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleColorSelect = (color: typeof colors[0]) => {
    setSelectedColor(color);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-8 text-center">
        🎨 Pick a Color! 🌈
      </h1>

      {/* Selected Color Display */}
      <div
        className={`w-48 h-48 md:w-64 md:h-64 rounded-3xl shadow-2xl mb-8 flex items-center justify-center transition-all duration-300 ${
          isAnimating ? "animate-bounce scale-110" : ""
        }`}
        style={{ backgroundColor: selectedColor.hex }}
      >
        <span className="text-white text-2xl md:text-4xl font-bold drop-shadow-lg">
          {selectedColor.name}
        </span>
      </div>

      {/* Color Grid */}
      <div className="grid grid-cols-4 gap-4 md:gap-6">
        {colors.map((color) => (
          <button
            key={color.name}
            onClick={() => handleColorSelect(color)}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-110 hover:shadow-xl ${
              selectedColor.name === color.name
                ? "ring-4 ring-white ring-offset-4 ring-offset-transparent scale-110"
                : ""
            }`}
            style={{ backgroundColor: color.hex }}
            aria-label={`Select ${color.name}`}
          />
        ))}
      </div>

      <p className="mt-8 text-xl text-gray-600 font-medium">
        Tap a color to select it! ✨
      </p>
    </div>
  );
};

export default ColorSelector;

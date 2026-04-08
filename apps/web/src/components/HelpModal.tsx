import React, { useState } from 'react';
import { HELP_CONTENT } from '../constants/help';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<keyof typeof HELP_CONTENT>('basic');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-indigo-600 rounded-lg text-white">📖</span>
            마이티 프라임 가이드
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-900/50">
          {(Object.keys(HELP_CONTENT) as Array<keyof typeof HELP_CONTENT>).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-semibold transition-all ${
                activeTab === tab 
                  ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {HELP_CONTENT[tab].title}
            </button>
          ))}
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {HELP_CONTENT[activeTab].items.map((item, idx) => (
              <div key={idx} className="group p-5 rounded-xl bg-slate-800/30 border border-slate-800/50 hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all duration-300">
                <h3 className="text-lg font-bold text-indigo-300 mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  {item.label}
                </h3>
                <p className="text-slate-400 leading-relaxed pl-3.5">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-slate-800/20 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
            마이티 프라임은 공정하고 투명한 게임 문화를 지향합니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;

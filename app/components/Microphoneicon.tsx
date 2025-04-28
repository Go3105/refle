/* eslint-disable react/prop-types */
import GreenAnimation from '../../public/MicrophoneAnimationGreen.json';
import BlueAnimation from '../../public/MicrophoneAnimationBlue.json';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

interface MicrophoneiconProps {
    isHovered?: boolean;
}

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const Microphoneicon: React.FC<MicrophoneiconProps> = ({ isHovered = false }) => {
    // ホバー状態に応じてアニメーションデータを変更
    const animationOptions = useMemo(() => {
        return {
            // ホバー時はBlueAnimation、通常時はGreenAnimationを使用
            animationData: isHovered ? BlueAnimation : GreenAnimation,
            loop: true,
            autoplay: true,
            // ホバー時は5倍速、通常時は1倍速
            speed: isHovered ? 15.0 : 1.0
        };
    }, [isHovered]);

    return (
        <div className="w-full h-full flex items-center justify-center">
            <div
                className="relative flex items-center justify-center"
                style={{
                    transform: isHovered ? 'scale(2)' : 'scale(1)',
                    transition: 'transform 0.3s ease'
                }}
            >
                <Lottie
                    {...animationOptions}
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                    rendererSettings={{
                        preserveAspectRatio: 'xMidYMid slice'
                    }}
                />
            </div>
        </div>
    );
}

export default Microphoneicon;
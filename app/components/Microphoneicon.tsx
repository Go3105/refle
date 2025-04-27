import MicrophoneAnimation from '../../public/MicrophoneAnimationYellow.json';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const Microphoneicon = () => {
    return (
        <Lottie
            animationData={MicrophoneAnimation}
            loop={true}
            autoplay={true}
            className="mb-8"
            style={{
                width: '100%',
                height: '100%',
            }}
        />
    );
}

export default Microphoneicon;
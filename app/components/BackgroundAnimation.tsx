import BackgroundWave from '../../public/BackgroundAnimation.json';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const BackgroundAnimation = () => {
    return (
        <Lottie
            animationData={BackgroundWave}
            loop={true}
            autoplay={true}
            style={{
                width: '100%',
                height: '100%',
            }}
        />
    );
}

export default BackgroundAnimation;